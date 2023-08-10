const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const resizeImg = require("resize-img");

const isDev = process.env.NODE_ENV !== "production";
const isMac = process.platform === "darwin";

const RPC = require("discord-rpc");

const { io } = require("socket.io-client");
const socket = io("http://localhost:5000/");

let mainWindow;

const createMainWindow = () => {
    mainWindow = new BrowserWindow({
        title: "Image Resizer",
        width: isDev ? 1000 : 500,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, "./preload.js"),
            contextIsolation: true,
            nodeIntegration: true,
        },
    });

    // Open devtools if in dev env
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.loadFile(path.join(__dirname, "./renderer/index.html"));
};

const createAboutWindow = () => {
    const aboutWindow = new BrowserWindow({
        title: "About Image Resizer",
        width: 300,
        height: 300,
    });

    aboutWindow.loadFile(path.join(__dirname, "./renderer/about.html"));
};

app.whenReady().then(() => {
    createMainWindow();

    const mainMenu = Menu.buildFromTemplate(menu);
    Menu.setApplicationMenu(mainMenu);

    // Remove mainWindow form memory on close
    mainMenu.on("closed", () => {
        mainWindow = null;
    });

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });

    const clientId = "1136297214516400269";
    // 1136297214516400269
    const client = new RPC.Client({
        transport: "ipc",
    });

    client.on("ready", async () => {
        console.log("ready!");

        socket.emit("join_room", {
            roomId: "c1a70b72fa9a081c",
        });

        socket.on("tabChanged", async (body) => {
            console.log(body);

            try {
                if (!body || !body.tab) return;
                const { tab } = body;

                let tabUrl;
                let isIconAvailable = true;

                if (
                    !tab.favIconUrl ||
                    !(
                        tab.favIconUrl.endsWith(".jpg") ||
                        tab.favIconUrl.endsWith(".jpeg") ||
                        tab.favIconUrl.endsWith(".png")
                    )
                ) {
                    isIconAvailable = false;
                }

                if (tab.url) {
                    tabUrl = tab.url.split("://")[1].split("/")[0];

                    if (tabUrl.startsWith("www.")) {
                        tabUrl = tabUrl.slice(4);
                    }
                }

                await client.setActivity({
                    // largeImageKey: tab.favIconUrl,
                    largeImageKey: `${
                        isIconAvailable
                            ? tab.favIconUrl
                            : "https://discord.hb.ru-msk.vkcs.cloud/internet.jpg"
                    }`,
                    // partySize: 10,
                    // partyMax: 5,
                    // partyId: "123",
                    state: `Visiting ${tabUrl}`,
                    startTimestamp: Date.now(),
                });
            } catch (error) {
                console.log(error);
            }
        });
    });

    client.login({ clientId });
});

// const menu = [
//     {
//         label: "File",
//         submenu: [
//             {
//                 label: "Quit",
//                 click: () => app.quit(),
//                 accelerator: "CmdOrCtrl+W",
//             },
//         ],
//     },
// ];

const menu = [
    ...(isMac
        ? [
              {
                  label: app.name,
                  submenu: [{ label: "About", click: createAboutWindow }],
              },
          ]
        : []),
    {
        role: "fileMenu",
    },
    ...(!isMac
        ? [
              {
                  label: "Help",
                  submenu: [
                      {
                          label: "About",
                          click: createAboutWindow,
                      },
                  ],
              },
          ]
        : []),
];

// Respond to icpRenderer resize
ipcMain.on("image:resize", (e, options) => {
    options.dest = path.join(os.homedir(), "imageresize");
    resizeImage(options);
});

// Resize the image
const resizeImage = async ({ imgPath, width, height, dest }) => {
    try {
        const newPath = await resizeImg(fs.readFileSync(imgPath), {
            width: +width,
            height: +height,
        });

        // Create Filename
        const filename = path.basename(imgPath);

        // Create dest folder if it not exists
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }

        // Write file to dest
        fs.writeFileSync(path.join(dest, filename), newPath);

        // Send success to render
        mainWindow.webContents.send("image:done");

        // Open dest folder
        shell.openPath(dest);
    } catch (error) {
        console.log(error);
    }
};

app.on("window-all-closed", () => {
    if (!isMac) {
        app.quit();
    }
});
