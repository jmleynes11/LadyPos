// The server supplies current grant bounds. This supplements server enforcement.
export function canUseResource(context, capability, resourceId) {
  if (!context?.capabilities?.[capability]) return false;
  const bounds = context.conditionalResources?.[capability];
  return bounds === undefined || (resourceId !== undefined && bounds.includes(String(resourceId)));
}
