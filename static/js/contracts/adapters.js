// static/js/contracts/adapters.js — List Response & Error Envelope Adapters

/**
 * Normalizes both PageResult ({ items, total, offset, limit }) and raw Array ([...])
 * responses into a unified pagination view model.
 */
export function adaptListResponse(payload, queryParams = {}) {
  const limit = Number(queryParams.limit) || 20;
  const offset =
    queryParams.offset !== undefined
      ? Number(queryParams.offset) || 0
      : Number(queryParams.skip) || 0;

  if (Array.isArray(payload)) {
    return {
      items: payload,
      total: offset + payload.length,
      offset,
      limit,
      hasMore: payload.length >= limit,
      mode: 'skip',
    };
  }

  if (payload && typeof payload === 'object' && Array.isArray(payload.items)) {
    const total = Number.isFinite(Number(payload.total)) ? Number(payload.total) : payload.items.length;
    const resolvedOffset = Number.isFinite(Number(payload.offset)) ? Number(payload.offset) : offset;
    const resolvedLimit = Number.isFinite(Number(payload.limit)) ? Number(payload.limit) : limit;
    return {
      items: payload.items,
      total,
      offset: resolvedOffset,
      limit: resolvedLimit,
      hasMore: resolvedOffset + payload.items.length < total,
      mode: 'offset',
    };
  }

  return {
    items: [],
    total: 0,
    offset: 0,
    limit,
    hasMore: false,
    mode: 'offset',
  };
}

