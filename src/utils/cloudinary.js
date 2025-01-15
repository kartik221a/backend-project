import {v2 as cloudinary} from 'cloudinary'
import fs from 'fs'

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null;
        const result = await cloudinary.uploader.upload(localFilePath, {
            unique_filename: false,
            overwrite: true,
            resource_type: auto,
        })
        console.log("File has been uploaded successfully!!!", result.url)
        return response

    } catch (error) {
        fs.unlinkSync(localFilePath) //remove the locally saved temporary file as the upload operation got failed
        return null
    }
}

export {uploadOnCloudinary}