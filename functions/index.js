const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();
const auth = getAuth();

async function requireAdmin(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const snap = await db.collection('userRoles').doc(request.auth.uid).get();
  if (!snap.exists || snap.data().active !== true || snap.data().role !== 'Administrador') {
    throw new HttpsError('permission-denied', 'Solo un administrador activo puede realizar esta operación.');
  }
  return snap.data();
}

exports.createManagedUser = onCall({ region: 'us-central1', enforceAppCheck: false }, async (request) => {
  const adminProfile = await requireAdmin(request);
  const { name, email, role } = request.data || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) {
    throw new HttpsError('invalid-argument', 'Nombre no válido.');
  }
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    throw new HttpsError('invalid-argument', 'Correo no válido.');
  }
  if (!['Administrador', 'Editor'].includes(role)) throw new HttpsError('invalid-argument', 'Rol no válido.');
  let user;
  try {
    user = await auth.createUser({ email: email.toLowerCase().trim(), displayName: name.trim(), emailVerified: false, disabled: false });
    await db.collection('userRoles').doc(user.uid).set({
      uid: user.uid, name: name.trim(), email: email.toLowerCase().trim(), role,
      active: true, createdAt: FieldValue.serverTimestamp(), createdBy: request.auth.uid
    });
    await db.collection('activity').add({
      actorUid: request.auth.uid, actorName: adminProfile.name || request.auth.token.email || 'Administrador',
      actorEmail: request.auth.token.email || '', role: 'Administrador', action: 'Creación de usuario',
      section: 'Usuarios', details: `Se creó ${email} con rol ${role}`, itemId: user.uid,
      createdAt: FieldValue.serverTimestamp()
    });
    return { uid: user.uid, email: user.email };
  } catch (error) {
    if (user?.uid) { try { await auth.deleteUser(user.uid); } catch (_) {} }
    if (error instanceof HttpsError) throw error;
    if (error.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'Ese correo ya tiene una cuenta.');
    throw new HttpsError('internal', 'No se pudo crear la cuenta.');
  }
});

exports.manageManagedUser = onCall({ region: 'us-central1', enforceAppCheck: false }, async (request) => {
  const adminProfile = await requireAdmin(request);
  const { uid, operation, role } = request.data || {};
  if (typeof uid !== 'string' || !uid || uid === request.auth.uid) {
    throw new HttpsError('invalid-argument', 'No puedes modificar tu propia cuenta desde aquí.');
  }
  const ref = db.collection('userRoles').doc(uid);
  const targetSnap = await ref.get();
  if (!targetSnap.exists) throw new HttpsError('not-found', 'Usuario no encontrado.');
  const target = targetSnap.data();
  if (operation === 'role') {
    if (!['Administrador', 'Editor'].includes(role)) throw new HttpsError('invalid-argument', 'Rol no válido.');
    if (target.role === 'Administrador' && role !== 'Administrador' && target.active !== false) {
      const admins = await db.collection('userRoles').where('role', '==', 'Administrador').where('active', '==', true).get();
      if (admins.size <= 1) throw new HttpsError('failed-precondition', 'Debe existir al menos un administrador activo.');
    }
    await ref.update({ role, updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid });
  } else if (operation === 'toggle') {
    const nextActive = target.active === false;
    if (!nextActive && target.role === 'Administrador') {
      const admins = await db.collection('userRoles').where('role', '==', 'Administrador').where('active', '==', true).get();
      if (admins.size <= 1) throw new HttpsError('failed-precondition', 'No puedes desactivar al último administrador.');
    }
    await ref.update({ active: nextActive, updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid });
    await auth.updateUser(uid, { disabled: !nextActive });
  } else {
    throw new HttpsError('invalid-argument', 'Operación no permitida.');
  }
  await db.collection('activity').add({
    actorUid: request.auth.uid, actorName: adminProfile.name || request.auth.token.email || 'Administrador',
    actorEmail: request.auth.token.email || '', role: 'Administrador', action: operation === 'role' ? 'Cambio de rol' : 'Cambio de estado',
    section: 'Usuarios', details: `Cuenta ${target.email}: ${operation === 'role' ? `rol ${role}` : 'estado actualizado'}`,
    itemId: uid, createdAt: FieldValue.serverTimestamp()
  });
  return { success: true };
});
