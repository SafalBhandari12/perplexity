import dotenv from "dotenv";
dotenv.config();

export const getEnvVariable = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
};

const env = {
  NODE_ENV: getEnvVariable("NODE_ENV"),
  PORT: parseInt(getEnvVariable("PORT"), 10),
  GOOGLE_API_KEY: getEnvVariable("GOOGLE_API_KEY"),
  WEATHER_API_KEY: getEnvVariable("WEATHER_API_KEY"),
  LANGCHAIN_API_KEY: getEnvVariable("LANGCHAIN_API_KEY"),
  LANGCHAIN_PROJECT: getEnvVariable("LANGCHAIN_PROJECT"),
  LANGCHAIN_TRACING_V2: getEnvVariable("LANGCHAIN_TRACING_V2") === "true",
};

export default env;
