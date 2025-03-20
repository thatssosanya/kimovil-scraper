const zip = <T, U>(a: T[], b: U[]): [T, U][] => {
  return a.map((_, i) => [a[i], b[i]]);
};

const transpose = <T>(matrix: T[][]): T[][] => {
  if (!matrix || matrix.length === 0) {
    return [];
  }

  const numRows = matrix.length;
  const numCols = matrix[0].length;

  for (let i = 1; i < numRows; i++) {
    if (matrix[i].length != numCols) {
      throw new Error("Input data is not uniform in shape!");
    }
  }

  const transposedMatrix = new Array(numCols)
    .fill(null)
    .map(() => new Array<T>(numRows));

  for (let i = 0; i < numRows; i++) {
    for (let j = 0; j < numCols; j++) {
      transposedMatrix[j][i] = matrix[i][j];
    }
  }

  return transposedMatrix;
};

export { zip, transpose };
