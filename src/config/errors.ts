import AppError from "../models/error.js";
export const errorCodes = {
  unexpected: 1999,
  notFound: 1000,
  validation: 1001,
} as const;

export const errors = {
  unexpected: AppError.custom(500, errorCodes.unexpected, "خطأ غير متوقع."),
  notFound: AppError.custom(404, errorCodes.notFound, "المسار غير موجود."),
  roomNotFound: AppError.custom(404, 1000, "الغرفة غير موجودة."),
  roomFull: AppError.custom(400, 1001, "الغرفة مكتملة."),
  nicknameInUse: AppError.custom(400, 1002, "الاسم مستخدم من قبل."),
  gameRunning: AppError.custom(400, 1003, "لا يمكن الدخول واللعبة تعمل."),
  unknownPlayer: AppError.custom(404, 1004, "اللاعب غير موجود."),
  noPermission: AppError.custom(403, 1005, "لا يوجد صلاحية."),
  cantKick: AppError.custom(400, 1006, "لا يمكن طرد نفسك او المسؤول."),
  playerBanned: AppError.custom(403, 1007, "لا يمكنك دخول هذه الغرفة."),
  invalidRoomOptions: AppError.custom(400, 1008, "اعدادات غير صحيحة."),
  alreadyInRoom: AppError.custom(400, 1009, "انت بالفعل في هذه الغرفة."),

  invalidAuth: AppError.custom(401, 1012, "رمز التوثيق غير صالح."),
};
