const service = require("../../services/master/materialService");

exports.getAll = async (req, res) => {
    try {
        const data = await service.getAllMaterials();
        res.json(data);
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.create = async (req, res) => {
    try {
        await service.addMaterial(req.body);

        res.json({
            success: true,
            message: "Material added successfully"
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.bulkCreate = async (req, res) => {
    try {

        const result = await service.bulkAddMaterials(req.body.items || []);

        res.json({
            success: true,
            inserted: result.inserted,
            message: "Bulk upload completed"
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

exports.update = async (req, res) => {
    try {

        await service.updateMaterial(
            req.params.id,
            req.body
        );

        res.json({
            success: true,
            message: "Updated"
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

exports.remove = async (req, res) => {
    try {

        await service.deleteMaterial(req.params.id);

        res.json({
            success: true,
            message: "Deleted"
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
};