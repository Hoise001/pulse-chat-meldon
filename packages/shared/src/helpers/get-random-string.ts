const getRandomString = (length: number): string => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  let result = "";

  for (let i = 0; i < length; i++) {
    result += characters.charAt(array[i]! % characters.length);
  }
  return result;
};

export { getRandomString };
