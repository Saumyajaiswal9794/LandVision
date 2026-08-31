import { Request, Response } from 'express';

export const getPlotBoundary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { khasraNumber, village } = req.query;
    res.status(200).json({
      khasraNumber,
      village,
      boundary: {
        type: 'Polygon',
        coordinates: [
          [
            [77.1025, 28.7041],
            [77.1035, 28.7041],
            [77.1035, 28.7051],
            [77.1025, 28.7051],
            [77.1025, 28.7041],
          ],
        ],
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const updatePlotBoundary = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      message: 'Plot boundaries updated successfully',
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};
