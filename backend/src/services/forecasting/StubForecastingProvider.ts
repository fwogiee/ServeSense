import { ForecastPrediction, ForecastingProvider } from "./ForecastingProvider";

export class StubForecastingProvider implements ForecastingProvider {
  async predictMenuItemWeekly(
    _menuItemId: string,
    _history: Array<{ weekStartDate: string; qtySold: number }>
  ): Promise<ForecastPrediction> {
    return {
      prediction: null,
      status: "not_implemented",
      message: "Forecasting provider is not implemented in V1.",
    };
  }
}
