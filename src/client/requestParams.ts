/**
 * Build top-level form params for REG.API.
 * Auth credentials MUST stay outside input_data (REG.API security rule).
 *
 * When `input_data` is an object, it is kept structured until after RSA signature
 * collection (Perl domain/create pattern), then stringified via finalizeRequestParams.
 */

export function mergeRequestParams(
  authParams: Record<string, string>,
  params: Record<string, unknown> = {},
  options: { stringifyInputData?: boolean } = {}
): Record<string, unknown> {
  const stringifyInputData = options.stringifyInputData !== false;

  const allParams: Record<string, unknown> = {
    ...authParams,
    ...params,
  };

  // Auth must always win at top level (never buried only inside input_data)
  for (const [key, value] of Object.entries(authParams)) {
    allParams[key] = value;
  }

  if (params.input_data !== undefined) {
    allParams.input_format = 'json';
    allParams.output_format = allParams.output_format ?? 'json';
    if (
      stringifyInputData &&
      typeof params.input_data === 'object' &&
      params.input_data !== null
    ) {
      allParams.input_data = JSON.stringify(params.input_data);
    }
  }

  return allParams;
}

/** Stringify structured input_data after signature was computed. */
export function finalizeRequestParams(
  params: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...params };
  if (typeof result.input_data === 'object' && result.input_data !== null) {
    result.input_format = result.input_format ?? 'json';
    result.output_format = result.output_format ?? 'json';
    result.input_data = JSON.stringify(result.input_data);
  }
  return result;
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
