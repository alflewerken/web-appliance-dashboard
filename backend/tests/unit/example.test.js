// Beispiel Test-Datei
describe('Example Test Suite', () => {
  it('should pass this simple test', () => {
    expect(2 + 2).toBe(4);
  });

  it('should test async operations', async () => {
    const promise = Promise.resolve('Hello');
    const result = await promise;
    expect(result).toBe('Hello');
  });
});
