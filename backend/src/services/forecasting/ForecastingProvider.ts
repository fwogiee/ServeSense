export interface ForecastPrediction {
  prediction: number | null;
  status: "ok" | "not_implemented";
  message?: string;
}

export interface ForecastingProvider {
  predictMenuItemWeekly(
    menuItemId: string,
    history: Array<{ weekStartDate: string; qtySold: number }>
  ): Promise<ForecastPrediction>;
}
