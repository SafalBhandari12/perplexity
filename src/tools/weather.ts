import { tool } from "langchain";
import { z } from "zod";
import env from "../utils/env.js";

const getWeather = tool(
  async ({ city }) => {
    const response = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${env.WEATHER_API_KEY}&q=${city}`,
    );

    if (!response.ok) {
      throw new Error(`Weather API failed: ${response.status}`);
    }

    const data = await response.json();

    return JSON.stringify({
      city: data.location.name,
      temperature: data.current.temp_c,
      condition: data.current.condition.text,
    });
  },
  {
    name: "get_weather",
    description: "Get current weather information for a city.",
    schema: z.object({
      city: z.string(),
    }),
  },
);

export default getWeather;
