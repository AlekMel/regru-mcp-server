/**
 * Build top-level form params for REG.API.
 * Auth credentials MUST stay outside input_data (REG.API security rule).
 */
export function mergeRequestParams(
  authParams: Record<string, string>,
  params: Record<string, unknown> = {}
): Record<string, unknown> {
  const allParams: Record<string, unknown> = {
    ...authParams,
    ...params,
  };

  if (params.input_data !== undefined) {
    allParams.input_format = 'json';
    allParams.output_format = 'json';
    if (typeof params.input_data === 'object' && params.input_data !== null) {
      allParams.input_data = JSON.stringify(params.input_data);
    }
  }

  return allParams;
}

export function buildFormData(params: Record<string, unknown>): string {
  const formParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      formParams.append(key, String(value));
    }
  }

  return formParams.toString();
}
