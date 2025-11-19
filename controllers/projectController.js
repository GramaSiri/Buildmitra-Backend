import Project from '../models/Project.js';
import Material from '../models/Material.js';
import Labour from '../models/Labour.js';

// Create a new project with auto-fetched rates and calculated BOQ totals
export const createProject = async (req, res) => {
  try {
    const boqItems = req.body.boqItems || [];

    const enrichedBOQ = await Promise.all(
      boqItems.map(async (item) => {
        const pin = item.pincode || '';

        const materialDoc = await Material.findOne({
          materialName: item.material,
          servicePincodes: { $regex: pin, $options: 'i' }
        });

        const labourDoc = item.labourType
          ? await Labour.findOne({
              skillType: item.labourType,
              servicePincodes: { $regex: pin, $options: 'i' }
            })
          : null;

        const materialRate = materialDoc?.rate || 0;
        const labourRate = labourDoc?.rate || 0;

        const materialAmount = (item.materialQty || 0) * materialRate;
        const labourAmount = (item.labourQty || 0) * labourRate;
        const totalAmount = materialAmount + labourAmount;

        return {
          ...item,
          materialRate,
          labourRate,
          materialAmount,
          labourAmount,
          totalAmount
        };
      })
    );

    req.body.boqItems = enrichedBOQ;
    req.body.boqTotal = enrichedBOQ.reduce((sum, i) => sum + (i.totalAmount || 0), 0);

    const project = new Project(req.body);
    await project.save();
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create project', details: err.message });
  }
};

// PATCH: Update a specific BOQ item by index
export const updateBoqItem = async (req, res) => {
  try {
    const { projectId, boqIndex } = req.params;
    const updates = req.body;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const item = project.boqItems[boqIndex];
    if (!item) return res.status(404).json({ error: 'BOQ item not found' });

    Object.assign(item, updates);

    item.materialAmount = (item.materialQty || 0) * (item.materialRate || 0);
    item.labourAmount = (item.labourQty || 0) * (item.labourRate || 0);
    item.totalAmount = item.materialAmount + item.labourAmount;

    project.boqTotal = project.boqItems.reduce((sum, i) => sum + (i.totalAmount || 0), 0);

    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update BOQ item', details: err.message });
  }
};

// GET: Fetch projects with optional client filter
export const getProjects = async (req, res) => {
  try {
    const { client } = req.query;
    const filter = client ? { clientName: { $regex: new RegExp(client, 'i') } } : {};
    const projects = await Project.find(filter);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects', details: err.message });
  }
};

// Health check
export const exitProjectFlow = (req, res) => {
  res.json({ message: 'Project flow exited successfully' });
};