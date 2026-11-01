// Shape of LibreHardwareMonitor's /data.json (Remote Web Server).
// Every level is the same node type; leaf nodes carry SensorId + Type.
export interface LhmNode {
  id: number;
  Text: string;
  Min: string;
  Value: string;
  Max: string;
  ImageURL: string;
  Children: LhmNode[];
  HardwareId?: string;
  SensorId?: string;
  Type?: SensorType;
  RawMin?: string;
  RawValue?: string;
  RawMax?: string;
}

export type SensorType =
  | 'Voltage'
  | 'Current'
  | 'Power'
  | 'Clock'
  | 'Temperature'
  | 'Load'
  | 'Frequency'
  | 'Fan'
  | 'Flow'
  | 'Control'
  | 'Level'
  | 'Factor'
  | 'Data'
  | 'SmallData'
  | 'Throughput'
  | 'TimeSpan'
  | 'Timing'
  | 'Energy'
  | 'Noise'
  | 'Conductivity'
  | 'Humidity';

export type HardwareKind =
  | 'cpu'
  | 'gpu'
  | 'motherboard'
  | 'memory'
  | 'dimm'
  | 'storage'
  | 'network'
  | 'other';

export interface Sensor {
  id: string; // SensorId, unique and stable across polls
  name: string;
  type: SensorType;
  value: number | null;
  min: number | null;
  max: number | null;
  unit: string;
  hardwareId: string;
}

export interface Hardware {
  id: string; // HardwareId
  name: string;
  kind: HardwareKind;
  sensors: Sensor[];
  children: Hardware[]; // e.g. SuperIO chip under motherboard
}

export interface Snapshot {
  machine: string;
  hardware: Hardware[];
  sensorsById: Map<string, Sensor>;
  timestamp: number;
}
