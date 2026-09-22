const validator = require('validator');
const text = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const code = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);
function validateCheckoutInput(body = {}) {
  const errors = [];
  if (!text(body.name, 3, 120)) errors.push('Nome invalido.');
  if (!text(body.email, 3, 254) || !validator.isEmail(body.email)) errors.push('E-mail invalido.');
  if (!text(body.phone, 10, 24) || !/^[+\d ()-]+$/.test(body.phone) || !/^\d{10,15}$/.test(body.phone.replace(/\D/g, ''))) errors.push('Telefone invalido.');
  if (body.cpf && (!text(body.cpf, 11, 14) || !/^\d{11}$/.test(body.cpf.replace(/\D/g, '')))) errors.push('CPF invalido.');
  if (!text(body.zipCode, 8, 9) || !/^\d{5}-?\d{3}$/.test(body.zipCode)) errors.push('CEP invalido.');
  if (!text(body.address, 5, 300)) errors.push('Endereco invalido.');
  if (!Number.isSafeInteger(body.quantity) || body.quantity < 1 || body.quantity > 10) errors.push('Quantidade invalida.');
  if (body.couponCode && !code(body.couponCode)) errors.push('Cupom invalido.');
  return { valid: !errors.length, errors };
}
module.exports = { validateCheckoutInput, text, code };
