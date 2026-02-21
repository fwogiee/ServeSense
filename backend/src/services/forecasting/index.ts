import { ForecastingProvider } from "./ForecastingProvider";
import { StubForecastingProvider } from "./StubForecastingProvider";

export const forecastingProvider: ForecastingProvider = new StubForecastingProvider();
