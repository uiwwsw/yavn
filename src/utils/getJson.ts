export const getJson = async <T>(fileName: string) => {
  const res = await fetch(`/${fileName}.json`);
  return await res.json() as T;
};
