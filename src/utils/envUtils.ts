// Purpose: Utility functions for working with environment vars.

// get env var value or throw error
export const getEnvironmentValue = (key: string, defaultValue = ""): string => {
    const value: string = process.env[key] || defaultValue;

    if (!value) {
      throw new Error(`Please set the environment variable "${key}"`);
    }

    return value;
  };

// check if running in AWS Lambda
export function isRunningInLambda(): boolean {
    return !!process.env.AWS_LAMBDA_FUNCTION_NAME;
}