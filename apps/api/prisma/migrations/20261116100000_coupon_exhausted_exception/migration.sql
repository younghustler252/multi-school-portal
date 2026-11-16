-- REM-069: a captured payment whose coupon use was taken by someone else before it could be applied becomes an open exception of this kind.
ALTER TYPE "CapturedPaymentExceptionKind" ADD VALUE IF NOT EXISTS 'coupon_exhausted';
