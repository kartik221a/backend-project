const asyncHandler = (functionWrapper) => {
    return (req, res, next) => {
        Promise
        .resolve(functionWrapper(req, res, next))
        .catch((error) => next(error))
    }
}

export {asyncHandler}