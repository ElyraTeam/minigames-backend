const error = (code: number, message: string) => ({
  errorCode: code,
  error: message,
});

export const roomNotFound = error(1000, "الغرفة غير موجودة.");
export const roomFull = error(1001, "الغرفة مكتملة.");
export const nicknameInUse = error(1002, "الاسم مستخدم من قبل.");
export const gameRunning = error(1003, "لا يمكن الدخول واللعبة تعمل.");
export const unknownPlayer = error(1004, "اللاعب غير موجود.");
export const noPermission = error(1005, "لا يوجد صلاحية.");
export const cantKick = error(1006, "لا يمكن طرد نفسك او المسؤول.");
export const playerBanned = error(1007, "لا يمكنك دخول هذه الغرفة.");
export const invalidRoomOptions = error(1008, "اعدادات غير صحيحة.");
export const alreadyInRoom = error(1009, "انت بالفعل في هذه الغرفة.");

export const unexpectedError = error(1010, "خطأ غير متوقع.");
