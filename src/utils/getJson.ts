export const getJson = async <T>(fileName: string) => {
  const res = await fetch(`/${fileName}.json?t=${Date.now()}`);
  return await res.json() as T;
};
