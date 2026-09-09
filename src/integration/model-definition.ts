export interface ModelDefinition {
  key: string;
  enabled: boolean;
  schemaVersion: number;
  destinationPath: string;
  queryFile: string;
  cursorColumn: string;
  sourceIdColumn: string;
  initialCursor: string | number;
}
