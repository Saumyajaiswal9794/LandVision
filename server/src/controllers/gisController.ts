import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { getPlotByKhasra, getPlotsByVillage } from '../services/gis/plotQueries';

// Sprint 4: Get all plots for a village as GeoJSON FeatureCollection
export const getVillagePlots = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { villageName } = req.params;

    if (!villageName) {
      res.status(400).json({ error: 'villageName is required' });
      return;
    }

    const featureCollection = await getPlotsByVillage(villageName);
    res.status(200).json(featureCollection);
  } catch (error) {
    console.error('getVillagePlots error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
};

// Sprint 4: Get a single plot by khasra number
export const getPlotByKhasraRoute = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { khasraNumber } = req.params;
    const village = req.query.village as string | undefined;

    if (!khasraNumber) {
      res.status(400).json({ error: 'khasraNumber is required' });
      return;
    }

    if (!village) {
      res.status(400).json({ error: 'village query parameter is required' });
      return;
    }

    const feature = await getPlotByKhasra(khasraNumber, village);

    if (!feature) {
      res.status(404).json({ error: 'Plot not found' });
      return;
    }

    res.status(200).json(feature);
  } catch (error) {
    console.error('getPlotByKhasraRoute error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
};

// Legacy placeholder (kept for backward compatibility)
export const getPlotBoundary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { khasraNumber, village } = req.query;
    res.status(200).json({
      khasraNumber,
      village,
      boundary: {
        type: 'Polygon',
        coordinates: [
          [77.1025, 28.7041],
          [77.1035, 28.7041],
          [77.1035, 28.7051],
          [77.1025, 28.7051],
          [77.1025, 28.7041],
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
