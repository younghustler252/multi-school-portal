// type CacheOptions = {
//     key: string;
//     ttl?: number;
// };

// export async function withCache<T>(
//     { key, ttl = 120 }: CacheOptions,
//     fn: () => Promise<T>
// ): Promise<T> {
//     const cached = await redis.get(key);
//     if (cached) {
//         return JSON.parse(cached) as T;
//     }

//     const data = await fn();

//     await redis.setex(key, ttl, JSON.stringify(data));

//     return data;
// }
