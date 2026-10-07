// Node resolve hook so game modules (which import the bare specifier 'three') can run in unit tests.
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: new URL('../vendor/three.module.js', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
