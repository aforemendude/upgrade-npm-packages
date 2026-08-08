type SortContext = 'root' | 'regular' | 'exports' | 'imports' | 'conditions';

const isObject = (value: unknown): value is object => value !== null && typeof value === 'object';

const isEnumerableStringKey = (value: object, key: string | symbol): key is string => {
  return typeof key === 'string' && Object.prototype.propertyIsEnumerable.call(value, key);
};

const getOrderedOwnKeys = (value: object, context: SortContext): (string | symbol)[] => {
  const ownKeys = Reflect.ownKeys(value);
  const jsonKeys = ownKeys.filter((key) => isEnumerableStringKey(value, key));
  const isConditionalExportsObject = context === 'exports' && jsonKeys.every((key) => !key.startsWith('.'));
  const preserveKeyOrder = context === 'conditions' || isConditionalExportsObject;
  const orderedJsonKeys = preserveKeyOrder ? jsonKeys : [...jsonKeys].sort();
  const otherKeys = ownKeys.filter((key) => !isEnumerableStringKey(value, key));

  // Include non-enumerable and symbol keys to satisfy Proxy invariants. JSON.stringify ignores them.
  return [...orderedJsonKeys, ...otherKeys];
};

const getNestedContext = (parent: object, context: SortContext, key: string): SortContext => {
  if (Array.isArray(parent)) {
    return context === 'root' ? 'regular' : context;
  }

  if (context === 'root' && key === 'exports') {
    return 'exports';
  }

  if (context === 'root' && key === 'imports') {
    return 'imports';
  }

  if (context === 'exports' || context === 'imports' || context === 'conditions') {
    return 'conditions';
  }

  return 'regular';
};

export const stringifyJsonWithSortedKeys = (value: unknown): string => {
  const proxyContexts = new WeakMap<object, SortContext>();
  const proxyCaches = new Map<SortContext, WeakMap<object, object>>();
  let isRoot = true;

  const getSortingProxy = (currentValue: object, context: SortContext): object => {
    let proxyCache = proxyCaches.get(context);

    if (proxyCache === undefined) {
      proxyCache = new WeakMap<object, object>();
      proxyCaches.set(context, proxyCache);
    }

    const cachedProxy = proxyCache.get(currentValue);
    if (cachedProxy !== undefined) {
      return cachedProxy;
    }

    const handler: ProxyHandler<object> = {
      // Accessors should receive the original object, as they do with JSON.stringify(value).
      get: (target, key) => Reflect.get(target, key, target),
    };

    if (!Array.isArray(currentValue)) {
      handler.ownKeys = (target) => getOrderedOwnKeys(target, context);
    }

    const proxy = new Proxy(currentValue, handler);
    proxyCache.set(currentValue, proxy);
    proxyContexts.set(proxy, context);
    return proxy;
  };

  // Wrap each value only when JSON.stringify reaches it, avoiding a cloned object graph.
  return JSON.stringify(
    value,
    function (this: object, key: string, currentValue: unknown): unknown {
      let context: SortContext;

      if (isRoot) {
        isRoot = false;
        context = 'root';
      } else {
        const parentContext = proxyContexts.get(this);
        context = parentContext === undefined ? 'regular' : getNestedContext(this, parentContext, key);
      }

      return isObject(currentValue) ? getSortingProxy(currentValue, context) : currentValue;
    },
    2,
  );
};
