const SERVER_BASE = "http://192.168.1.22:4000/";
const basePath = SERVER_BASE;

export default [
  {
    type: "msdf",
    fontFamily: "Roboto700",
    atlasDataUrl: basePath + "fonts/Roboto-Bold.msdf.json",
    atlasUrl: basePath + "fonts/Roboto-Bold.msdf.png",
  } as const,
  {
    type: "msdf",
    fontFamily: "Roboto",
    atlasDataUrl: basePath + "fonts/Roboto-Regular.msdf.json",
    atlasUrl: basePath + "fonts/Roboto-Regular.msdf.png",
  } as const,
  {
    type: "msdf",
    fontFamily: "Arial",
    atlasDataUrl: basePath + "fonts/Roboto-Regular.msdf.json",
    atlasUrl: basePath + "fonts/Roboto-Regular.msdf.png",
  } as const,
];
// const basePath = ""; //import.meta.env.BASE_URL;

// export default [
//   {
//     type: "msdf",
//     fontFamily: "Roboto700",
//     atlasDataUrl: basePath + "fonts/Roboto-Bold.msdf.json",
//     atlasUrl: basePath + "fonts/Roboto-Bold.msdf.png",
//   } as const,
//   {
//     type: "msdf",
//     fontFamily: "Roboto",
//     atlasDataUrl: basePath + "fonts/Roboto-Regular.msdf.json",
//     atlasUrl: basePath + "fonts/Roboto-Regular.msdf.png",
//   } as const,
//   {
//     type: "msdf",
//     fontFamily: "Arial",
//     atlasDataUrl: basePath + "fonts/Roboto-Regular.msdf.json",
//     atlasUrl: basePath + "fonts/Roboto-Regular.msdf.png",
//   } as const,
// ];
