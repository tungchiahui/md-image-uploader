export type PasteProgressStage =
  | 'preparing'
  | 'converting'
  | 'routing'
  | 'uploading';

export interface PasteProgressEvent {
  stage: PasteProgressStage;
  objectKey?: string;
}

export type PasteProgressReporter = (event: PasteProgressEvent) => void;
