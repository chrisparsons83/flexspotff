export const getCurrentTime = (mockTime?: string) => {
  // Only allow mock time if it has the correct secret key prefix
  const timeSecret = process.env.TIME_MOCK_SECRET;

  if (mockTime && timeSecret) {
    const expectedPrefix = `${timeSecret}:`;

    if (mockTime.startsWith(expectedPrefix)) {
      // Remove the secret prefix and parse the actual time
      const actualTime = mockTime.replace(expectedPrefix, '');
      const parsedTime = new Date(actualTime);

      // Verify it's a valid date
      if (!isNaN(parsedTime.getTime())) {
        return parsedTime;
      }
    }
  }

  return new Date();
};
