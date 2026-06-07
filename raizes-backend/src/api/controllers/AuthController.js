const { cadastrarUsuario } = require('../../application/auth/cadastrarUsuario');
const { loginCliente, loginColaborador, loginCentral } = require('../../application/auth/loginUsuario');

async function register(req, res, next) {
  try {
    const cliente = await cadastrarUsuario(req.body);
    return res.status(201).json(cliente);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { tipo = 'cliente', ...credenciais } = req.body;

    let resultado;
    if (tipo === 'colaborador') {
      resultado = await loginColaborador(credenciais);
    } else if (tipo === 'central') {
      resultado = await loginCentral(credenciais);
    } else {
      resultado = await loginCliente(credenciais);
    }

    return res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  // JWT é stateless — o logout é responsabilidade do cliente
  // descartar o token no front-end
  return res.status(204).send();
}

module.exports = { register, login, logout };
