export interface NoDataProps {
  height?: number;
  text?: string;
}

export function NoData({ height = 220, text = "No synced data to chart yet." }: NoDataProps) {
  return (
    <div className="flex items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground" style={{ height }}>
      {text}
    </div>
  );
}
