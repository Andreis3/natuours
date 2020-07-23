const AppError = require('./../utils/appError');

const handlerObjectIdError = err => {
  const message = {
    value: err.stringValue,
    path: err.path
  };
  return new AppError(JSON.stringify(message), 400);
};

const handlerDuplicateFields = err => {
  let value = JSON.stringify(err.keyValue);
  //[,value] = value.split("{")[1].split("}")[0].split(":")
  //value = value.match(/(["'])(\\?.)*?\1/);
  [, value] = value.match(/{(.*?)}/)[1].split(':');
  const message = `Duplicate field value ${value}. Please use another value`;
  return new AppError(message, 400);
};

const handlerValidatorError = err => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });

    // Programming or other unknown error: don't leak error details
  } else {
    // 1) Log error
    console.error('ERROR 💥 ', err);

    res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!'
    });
  }
};

const handlerJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handlerJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again', 401);

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };

    if (error.status === 'error' && error.kind === 'ObjectId')
      error = handlerObjectIdError(error);

    if (error.code === 11000) error = handlerDuplicateFields(error);
    if (error._message === 'Validation failed')
      error = handlerValidatorError(error);
    if (error.name === 'JsonWebTokenError') error = handlerJWTError();
    if (error.name === 'TokenExpiredError') error = handlerJWTExpiredError();

    sendErrorProd(error, res);
  }
};
