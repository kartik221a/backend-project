import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from 'jsonwebtoken'
import mongoose from "mongoose";

const cookieOptions = {
    httpOnly: true,
    secure: true
}

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)

        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()

        user.refreshToken = await refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens")
    }
}


/* CREATING USER AUTHENTICAIONS */
const registerUser = asyncHandler(async (req, res) => {
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
    const { fullName, username, email, password } = req.body

    /* step 2: validation - not empty */
    if ([fullName, username, email, password].some((field) => (field?.trim() === ""))) {
        throw new ApiError(400, "All fields are required!")
    }

    /* step 3: check if user already exist (username and email) */
    const userExists = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (userExists) {
        throw new ApiError(409, "User with same email or username is already exists.")
    }

    /* step 4: check for images */
    const avatarLocalPath = await req.files?.avatar[0]?.path;
    let coverImageLocalPath;

    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = await req.files?.coverImage[0]?.path;
    } else {
        coverImageLocalPath = ""
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required - (local)")
    }

    /* step 5: upload images to cloudinary  */
    const avatar = await uploadOnCloudinary(avatarLocalPath)



    const coverImage = await uploadOnCloudinary(coverImageLocalPath)


    /* step 6: check succussfully upload on cloudinary */
    if (!avatar?.url) {
        throw new ApiError(400, "Avatar file is required - (cloudinary)")
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
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    /* step 9: check for user creation */
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user!")
    }

    /* step 10: return response */
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

})


const loginUser = asyncHandler(async (req, res) => {
    /*
        step 1: req data from body
        step 2: check for username or email
        step 3: find the user by username or email
        step 4: check the password
        step 5: generate access and refresh token
        step 6: send cookie
    */

    /* step 1: req data from body */
    const {email, username, password} = req.body

    /* step 2: check for username or email */
    if(!(email?.trim() || username?.trim())){
        throw new ApiError(400, "username or email is required!")
    }

    /* step 3: find the user by username or email */
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    //if user not found
    if(!user){
        throw new ApiError(404, "User does not exist")
    }

    /* step 4: check the password */
    const isCorrect = await user.isPasswordCorrect(password)

    if(!isCorrect){
        throw new ApiError(400, "Invalid user credentials")
    }

    /* step 5: generate access and refresh token */
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)
    
    
    /* step 6: send cookie */
    
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // const cookieOptions = {
    //     httpOnly: true,
    //     secure: true
    // }
    const cookieOptions = {
        httpOnly: true
    }
    
    // console.log("SETTING COOKIES)
    // console.log("accessToken ---> ", accessToken)
    // console.log("refreshToken ---> ", refreshToken)

    // console.log(res
    // .cookie("accessToken", accessToken, cookieOptions)
    // .cookie("refreshToken", refreshToken, cookieOptions)
    // .json(
    //     new ApiResponse(
    //         200,
    //         {
    //             user: loggedInUser, accessToken, refreshToken
    //         },
    //         "user logged in successfully"
    //     )
    // )
    // )

    return res
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "user logged in successfully"
        )
    )

})


const logoutUser = asyncHandler(async (req, res) => {
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )


    return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(
        new ApiResponse(200, {}, "User logged out successfully")
    )


})


const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken

        if(!incomingRefreshToken){
            throw new ApiError(401, "Unauthorized request")
        }
    
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken._id)
    
        if(!user){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if(user.refreshToken !== incomingRefreshToken){
            throw new ApiError(401, "The access token is either used or expired")
        }
    
        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken, refreshToken
                },
                "access token refreshed successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }



})

/* EDITIING USERS AUTHENTICATION */

const changeCurrentPassword = asyncHandler(async (req, res) => {``
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(401, "Password is invalid!")
    }

    user.password = newPassword

    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Password changed successfully!")
    )
})


const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(
        new ApiResponse(200, req.user, "current user fetched successfully"
        )
    )
})


const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullName, username} = req.body

    if(!fullName || !username){
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                username
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Account details updated successfully")
    )
})


const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar?.url){
        throw new ApiError(400, "Error while uploading")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: { avatar: avatar.url }
        },
        {
            new: true
        }
    )

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage?.url){
        throw new ApiError(400, "Error while uploading")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: { coverImage: coverImage.url }
        },
        {
            new: true
        }
    )

    return res.
    status(200)
    .json(
        new ApiResponse(200, user, "cover image updated successfully")
    )

})


const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params

    if(!username.trim()){
        throw new ApiError(404, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber" ] },
                        then: true,
                        else: false
                    }
                }
            }
            
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel does not exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )


})


const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id ",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: { $first: "$owner" }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200, user[0].watchHistory, "watch history fetched successfully")
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}