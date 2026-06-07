const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'NAO_AUTENTICADO',
      message: 'Token de autenticação não informado.',
      details: [],
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'TOKEN_INVALIDO',
      message: 'Token inválido ou expirado.',
      details: [],
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
  }
}

function autorizar(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        error: 'NAO_AUTENTICADO',
        message: 'Usuário não autenticado.',
        details: [],
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }

    if (!perfisPermitidos.includes(req.usuario.perfil)) {
      return res.status(403).json({
        error: 'SEM_PERMISSAO',
        message: 'Seu perfil não tem permissão para acessar este recurso.',
        details: [],
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }

    next();
  };
}

module.exports = { authMiddleware, autorizar };
