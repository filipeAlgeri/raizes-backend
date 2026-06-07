function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;

  const body = {
    error: err.code || 'ERRO_INTERNO',
    message: err.message || 'Erro interno do servidor.',
    details: err.details || [],
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  };

  if (process.env.NODE_ENV !== 'production' && status === 500) {
    console.error(err.stack);
  }

  return res.status(status).json(body);
}

module.exports = errorHandler;
