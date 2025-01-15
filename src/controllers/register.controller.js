import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler( async (req, res) => {
    /*
        step 1: get user details from frontend
        step 2: validation - not empty
        step 3: check if user already exist (username and email)
        step 4: check for images, compulsory check for avatar
        step 5: upload images to cloudinary
        step 6: check succussfully upload on cloudinary
        step 7: create user object - create entry in db
        step 8: remove pasword and refresh token field from response
        step 9: check for user creation
        step 10: return response
    */

    /* step 1: get user details from frontend */
    const {fullName, username, email, password} = req.body

    /* step 2: validation - not empty */
    if([fullName, username, email, password].some((field)=>{
        field?.trim() === ""
    })){
        throw new ApiError(400, "All fields are required!")
    }
    
    /* step 3: check if user already exist (username and email) */
    const userExists = User.findOne({
        $or: [{ username },{ email }]
    })

    if(userExists){
        throw new ApiError(409, "User with same email or username is already exists.")
    }

    /* step 4: check for images */
    const avatarLocalPath = await req.files?.avatar[0].path
    const coverImageLocalPath = await req.files?.coverImage[0].path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    /* step 5: upload images to cloudinary  */
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(cloudImageLocalPath)

    /* step 6: check succussfully upload on cloudinary */
    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    /* step 7: create user object - create entry in db */
    const user = await User.create({
        username: username.toLowerCase(),
        fullName,
        email,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    /* step 8: remove pasword and refresh token field from response */
    const createdUser = await user.findById(user._id).select(
        "-password -refreshToken"
    )

    /* step 9: check for user creation */
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user!")
    }
    
    /* step 10: return response */
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

})

export default registerUser