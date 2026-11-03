const pool = require("../config/database");
const {
    uploadImage,
    deleteImage,
} = require("./cloudinaryService");

const ALLOWED_ENTITY_TYPES = [
    "profile",
    "category",
    "service",
    "opportunity",
];

const validateEntityType = (entityType) => {
    if (!ALLOWED_ENTITY_TYPES.includes(entityType)) {
        const error = new Error("Invalid media entity type");
        error.statusCode = 400;
        throw error;
    }
};

const createMedia = async ({
    file,
    entityType,
    entityId,
    folder,
    sortOrder = 0,
}) => {
    if (!file || !file.buffer) {
        const error = new Error("Image file is required");
        error.statusCode = 400;
        throw error;
    }

    if (!entityType) {
        const error = new Error("Media entity type is required");
        error.statusCode = 400;
        throw error;
    }

    if (!entityId) {
        const error = new Error("Media entity ID is required");
        error.statusCode = 400;
        throw error;
    }

    validateEntityType(entityType);

    let uploadedImage = null;

    try {
        // Upload the image to Cloudinary first.
        uploadedImage = await uploadImage(file.buffer, folder);

        // Save the Cloudinary information in PostgreSQL.
        const result = await pool.query(
            `
      INSERT INTO media (
        entity_type,
        entity_id,
        cloudinary_public_id,
        url,
        width,
        height,
        format,
        bytes,
        sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id,
        entity_type,
        entity_id,
        cloudinary_public_id,
        url,
        width,
        height,
        format,
        bytes,
        sort_order,
        created_at
      `,
            [
                entityType,
                entityId,
                uploadedImage.publicId,
                uploadedImage.url,
                uploadedImage.width,
                uploadedImage.height,
                uploadedImage.format,
                uploadedImage.bytes,
                sortOrder,
            ],
        );

        return result.rows[0];
    } catch (error) {
        // If PostgreSQL fails after Cloudinary upload,
        // remove the Cloudinary image so we don't leave an orphaned file.
        if (uploadedImage?.publicId) {
            try {
                await deleteImage(uploadedImage.publicId);
            } catch (cleanupError) {
                console.error(
                    "Failed to clean up Cloudinary image:",
                    cleanupError,
                );
            }
        }

        throw error;
    }
};

const getMediaForEntity = async ({
    entityType,
    entityId,
}) => {
    validateEntityType(entityType);

    const result = await pool.query(
        `
    SELECT
      id,
      entity_type,
      entity_id,
      cloudinary_public_id,
      url,
      width,
      height,
      format,
      bytes,
      sort_order,
      created_at
    FROM media
    WHERE entity_type = $1
      AND entity_id = $2
    ORDER BY sort_order ASC, created_at ASC
    `,
        [entityType, entityId],
    );

    return result.rows;
};

const deleteMedia = async (mediaId) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const mediaResult = await client.query(
            `
      SELECT
        id,
        cloudinary_public_id
      FROM media
      WHERE id = $1
      FOR UPDATE
      `,
            [mediaId],
        );

        if (mediaResult.rows.length === 0) {
            const error = new Error("Media not found");
            error.statusCode = 404;
            throw error;
        }

        const media = mediaResult.rows[0];

        // Delete from Cloudinary first.
        await deleteImage(media.cloudinary_public_id);

        // Then remove the database record.
        const deleteResult = await client.query(
            `
      DELETE FROM media
      WHERE id = $1
      RETURNING id
      `,
            [mediaId],
        );

        await client.query("COMMIT");

        return deleteResult.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    createMedia,
    getMediaForEntity,
    deleteMedia,
};