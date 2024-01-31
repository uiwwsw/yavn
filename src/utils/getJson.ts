export const getJson = async (fileName: string) => {
  const res = await fetch(`/${fileName}.json`);
  return await res.json();
};
