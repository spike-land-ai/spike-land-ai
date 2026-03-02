import React from "react";
export default React;
// @ts-expect-error -- react uses export = which conflicts with export *
export * from "react";
