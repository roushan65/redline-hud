// REDLINE//HUD desktop shell. The React UI runs in the system webview; this side replaces the
// Node config server (server/configApi.ts) with commands that keep config.json, the uploaded logo
// and vendors/ in the app's config folder, and it polls LibreHardwareMonitor so the webview never
// runs into CORS, mixed-content or macOS App Transport Security rules.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::BTreeMap;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::Engine;
use serde_json::Value;
use tauri::http::{header, Response, StatusCode};
use tauri::{AppHandle, Manager, State};

const MAX_CONFIG_BYTES: usize = 256 * 1024;
const MAX_LOGO_BYTES: usize = 5 * 1024 * 1024;
const MAX_LHM_BYTES: usize = 16 * 1024 * 1024;
const LHM_TIMEOUT: Duration = Duration::from_secs(5);

/// data: URL media type → file extension, same set the web config API accepts.
const LOGO_TYPES: [(&str, &str); 5] = [
    ("image/png", "png"),
    ("image/jpeg", "jpg"),
    ("image/webp", "webp"),
    ("image/gif", "gif"),
    ("image/svg+xml", "svg"),
];

struct Lhm(reqwest::Client);

fn content_type(ext: &str) -> Option<&'static str> {
    LOGO_TYPES.iter().find(|(_, e)| *e == ext).map(|(t, _)| *t)
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join("vendors")).map_err(|e| format!("could not create {}: {e}", dir.display()))?;
    Ok(dir)
}

/// Write to a temp file then rename, so a crash never leaves a half-written file behind.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_file_name(format!(".{}.tmp", path.file_name().unwrap_or_default().to_string_lossy()));
    fs::write(&tmp, bytes).and_then(|_| fs::rename(&tmp, path)).map_err(|e| e.to_string())
}

/// `logo.png` etc. — the only logo file names that are ever read or written.
fn is_logo_file(name: &str) -> bool {
    name.strip_prefix("logo.").is_some_and(|ext| content_type(ext).is_some())
}

/// `amd.svg`, `wd.png`, … (lower-case id up to 32 chars). No separators, so no way out of vendors/.
fn vendor_id(name: &str) -> Option<&str> {
    let (id, ext) = name.rsplit_once('.')?;
    let id_ok = (1..=32).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    (id_ok && content_type(ext).is_some()).then_some(id)
}

fn logo_files(dir: &Path) -> Result<Vec<String>, String> {
    let mut names: Vec<String> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| is_logo_file(n))
        .collect();
    names.sort();
    Ok(names)
}

fn remove_logos(dir: &Path) -> Result<(), String> {
    for name in logo_files(dir)? {
        fs::remove_file(dir.join(name)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Folder shown in Settings so people know where config.json and vendors/ live.
#[tauri::command]
fn config_location(app: AppHandle) -> Result<String, String> {
    Ok(config_dir(&app)?.display().to_string())
}

/// config.json, or null on first run.
#[tauri::command]
fn config_get(app: AppHandle) -> Result<Option<Value>, String> {
    match fs::read(config_dir(&app)?.join("config.json")) {
        Ok(bytes) => serde_json::from_slice(&bytes).map(Some).map_err(|e| format!("config.json is not valid JSON: {e}")),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn config_put(app: AppHandle, config: Value) -> Result<(), String> {
    if !config.is_object() {
        return Err("Config must be a JSON object".into());
    }
    let mut text = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    text.push('\n');
    if text.len() > MAX_CONFIG_BYTES {
        return Err("Config is larger than 256 KB".into());
    }
    write_atomic(&config_dir(&app)?.join("config.json"), text.as_bytes())
}

/// Saves an uploaded logo (sent as a base64 data: URL) as logo.<ext>.
#[tauri::command]
fn logo_put(app: AppHandle, data_url: String) -> Result<(), String> {
    let (meta, data) = data_url.strip_prefix("data:").and_then(|r| r.split_once(',')).ok_or("Not a data: URL")?;
    let mime = meta.strip_suffix(";base64").ok_or("Logo must be base64-encoded")?;
    let ext = LOGO_TYPES
        .iter()
        .find(|(t, _)| *t == mime)
        .map(|(_, e)| *e)
        .ok_or_else(|| format!("Unsupported image type \"{mime}\" (png, jpeg, webp, gif, svg)"))?;
    if data.len() > MAX_LOGO_BYTES / 3 * 4 + 4 {
        return Err("Logo is larger than 5 MB".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD.decode(data).map_err(|e| format!("Bad base64: {e}"))?;
    if bytes.is_empty() {
        return Err("Empty image".into());
    }
    let dir = config_dir(&app)?;
    remove_logos(&dir)?;
    write_atomic(&dir.join(format!("logo.{ext}")), &bytes)
}

#[tauri::command]
fn logo_delete(app: AppHandle) -> Result<(), String> {
    remove_logos(&config_dir(&app)?)
}

/// { amd: "/api/vendors/amd.svg", … } for the manufacturer logos dropped into vendors/
/// (same shape as the web API; the UI maps the paths onto the hud: protocol).
#[tauri::command]
fn vendor_files(app: AppHandle) -> Result<BTreeMap<String, String>, String> {
    let mut names: Vec<String> = fs::read_dir(config_dir(&app)?.join("vendors"))
        .map_err(|e| e.to_string())?
        .flatten()
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    let mut out = BTreeMap::new();
    for name in names {
        if let Some(id) = vendor_id(&name) {
            out.entry(id.to_owned()).or_insert_with(|| format!("/api/vendors/{name}"));
        }
    }
    Ok(out)
}

/// GET a LibreHardwareMonitor data.json.
#[tauri::command]
async fn lhm_fetch(lhm: State<'_, Lhm>, url: String) -> Result<Value, String> {
    let parsed = reqwest::Url::parse(&url).map_err(|_| format!("\"{url}\" is not a full http:// URL"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only http:// and https:// endpoints are supported".into());
    }
    let res = lhm.0.get(parsed).send().await.map_err(|e| if e.is_timeout() { "Timed out".into() } else { e.to_string() })?;
    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status().as_u16()));
    }
    let body = res.bytes().await.map_err(|e| e.to_string())?;
    if body.len() > MAX_LHM_BYTES {
        return Err("Response is larger than 16 MB".into());
    }
    serde_json::from_slice(&body).map_err(|e| format!("Not JSON: {e}"))
}

/// hud://localhost/logo and hud://localhost/vendors/amd.svg (http://hud.localhost/… on Windows),
/// standing in for the web build's /api/logo and /api/vendors/amd.svg.
fn serve_file(app: &AppHandle, path: &str) -> Response<Vec<u8>> {
    let found = config_dir(app).ok().and_then(|dir| {
        let file = match path.split_once('/') {
            None if path == "logo" => logo_files(&dir).ok()?.into_iter().next()?,
            Some(("vendors", name)) if vendor_id(name).is_some() => format!("vendors/{name}"),
            _ => return None,
        };
        let mime = content_type(file.rsplit_once('.')?.1)?;
        Some((mime, fs::read(dir.join(file)).ok()?))
    });
    let res = Response::builder().header(header::CACHE_CONTROL, "no-cache").header("X-Content-Type-Options", "nosniff");
    let res = match found {
        Some((mime, bytes)) => res
            .header(header::CONTENT_TYPE, mime)
            // SVGs can carry script; they are only ever shown via <img>, but sandbox them anyway
            .header(header::CONTENT_SECURITY_POLICY, "default-src 'none'; style-src 'unsafe-inline'; sandbox")
            .body(bytes),
        None => res.status(StatusCode::NOT_FOUND).body(Vec::new()),
    };
    res.expect("static response headers are valid")
}

fn main() {
    let client = reqwest::Client::builder().timeout(LHM_TIMEOUT).build().expect("HTTP client");
    tauri::Builder::default()
        .manage(Lhm(client))
        .register_uri_scheme_protocol("hud", |ctx, req| serve_file(ctx.app_handle(), req.uri().path().trim_start_matches('/')))
        .invoke_handler(tauri::generate_handler![config_location, config_get, config_put, logo_put, logo_delete, vendor_files, lhm_fetch])
        .run(tauri::generate_context!())
        .expect("error while running REDLINE//HUD");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn logo_names() {
        assert!(is_logo_file("logo.png"));
        assert!(is_logo_file("logo.svg"));
        assert!(!is_logo_file("logo.exe"));
        assert!(!is_logo_file("../logo.png"));
        assert!(!is_logo_file("config.json"));
    }

    #[test]
    fn vendor_names() {
        assert_eq!(vendor_id("amd.svg"), Some("amd"));
        assert_eq!(vendor_id("sk-hynix.png"), Some("sk-hynix"));
        assert_eq!(vendor_id("AMD.svg"), None);
        assert_eq!(vendor_id("../amd.svg"), None);
        assert_eq!(vendor_id("amd.txt"), None);
        assert_eq!(vendor_id(".svg"), None);
    }
}
