import { useState, React, useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";

const DRAW_STATE_READY = 1;
const DRAW_STATE_START = 2;
const DRAW_STATE_MOVE_SEGMENT = 3;

const SHAPE_CLOSE_DISTANCE = 10;

const DRAW_STATE_LABELS = {
  [DRAW_STATE_READY]: "Click on canvas and drag it to start drawing",
  [DRAW_STATE_START]: "Click on another point to connect with the latest",
  [DRAW_STATE_MOVE_SEGMENT]: "Moving a segment of a shape",
};

function handleMouseDown(
  drawState,
  drawStateSetterFunction,
  currentShapeIndexSetterFunction,
  currentSegmentIndexSetterFunction
) {
  return (event) => {
    if (drawState === DRAW_STATE_READY) {
      const { isSegment, shapeIndex, pointIndex } = event.target.dataset;
      if (isSegment) {
        currentShapeIndexSetterFunction(Number(shapeIndex));
        currentSegmentIndexSetterFunction(Number(pointIndex));
        drawStateSetterFunction(DRAW_STATE_MOVE_SEGMENT);
      }
    }
  };
}

function findLastOpenShapeIndex(shapes) {
  return shapes.findIndex(({ points }) => {
    return points.length < 3 || points[0] !== points[points.length - 1];
  });
}

function continueDrawing(
  cursorPosition,
  drawStateSetterFunction,
  shapes,
  shapesSetterFunction,
  drawState
) {
  return (event) => {
    if (drawState === DRAW_STATE_MOVE_SEGMENT) {
      drawStateSetterFunction(DRAW_STATE_READY);
    }

    if (drawState === DRAW_STATE_START || drawState === DRAW_STATE_READY) {
      const canvasBoundingClientRect = document
        .querySelector(".canvas")
        .getBoundingClientRect();
      if (
        event.clientX < canvasBoundingClientRect.left ||
        event.clientX > canvasBoundingClientRect.right ||
        event.clientY < canvasBoundingClientRect.top ||
        event.clientY > canvasBoundingClientRect.bottom
      ) {
        return;
      }

      const lastOpenShapeIndex = findLastOpenShapeIndex(shapes);

      let newShapes;
      let newAppState = DRAW_STATE_START;
      if (lastOpenShapeIndex === -1) {
        newShapes = [...shapes, { points: [cursorPosition] }];
      } else {
        newShapes = shapes.map((shape, index) => {
          let newShape;
          if (index === lastOpenShapeIndex) {
            let cursorPositionOrClosingPoint;

            if (
              distance(
                cursorPosition.x,
                cursorPosition.y,
                shape.points[0].x,
                shape.points[0].y
              ) < SHAPE_CLOSE_DISTANCE
            ) {
              cursorPositionOrClosingPoint = shape.points[0];
              newAppState = DRAW_STATE_READY;
            } else {
              cursorPositionOrClosingPoint = cursorPosition;
            }

            newShape = {
              points: [...shape.points, cursorPositionOrClosingPoint],
            };
          } else {
            newShape = shape;
          }

          return newShape;
        });
      }

      drawStateSetterFunction(newAppState);
      shapesSetterFunction(newShapes);
    }
  };
}

function handleMouseMove(
  cursorPositionSetterFunction,
  drawState,
  currentShapeIndex,
  currentSegmentIndex,
  shapes,
  shapesSetterFunction
) {
  return ({ clientX, clientY }) => {
    const clientRect = document
      .querySelector(".canvas")
      .getBoundingClientRect();
    const cursorPosition = {
      x: clientX - clientRect.left,
      y: clientY - clientRect.top,
    };
    cursorPositionSetterFunction(cursorPosition);

    if (drawState === DRAW_STATE_MOVE_SEGMENT) {
      shapesSetterFunction(
        shapes.map((shape, shapeIndex) => ({
          ...shape,
          points: shape.points.map((point, pointIndex) =>
            currentShapeIndex === shapeIndex &&
            (currentSegmentIndex === pointIndex ||
              (currentSegmentIndex === shape.points.length - 1 &&
                pointIndex === 0))
              ? cursorPosition
              : point
          ),
        }))
      );
    }
  };
}

let replaceStateTimeoutId;

function useHashedState(name, defaults) {
  const [state, setState] = useState(defaults);
  return [
    state,
    (value, callback = () => {}) => {
      if (replaceStateTimeoutId) {
        clearTimeout(replaceStateTimeoutId);
      }

      replaceStateTimeoutId = setTimeout(() => {
        const [_, ...hashStates] = (
          window.location.href.indexOf("#") > -1
            ? window.location.href.split("#")
            : [null]
        ).filter(Boolean);

        let found = false;
        const builtHashStates = hashStates
          .reduce((prev, current) => {
            let [hashName, hashValue] = current.split("=");
            if (name === hashName) {
              found = true;
              hashValue = JSON.stringify(value);
              hashName = name;
            }

            return [...prev, `${hashName}=${hashValue}`];
          }, [])
          .join("#");

        if (!found) {
          window.history.pushState(
            null,
            null,
            `${
              builtHashStates && `#${builtHashStates}`
            }#${name}=${JSON.stringify(value)}`
          );
        } else {
          window.history.pushState(null, null, `#${builtHashStates}`);
        }
      }, 50);
      setState(value);
    },
    () => {
      const [head, fragment] = window.location.href.split(`#${name}=`);
      if (fragment) {
        const [value] = fragment.split("#");
        setState(JSON.parse(decodeURIComponent(value)));
      }
    },
  ];
}

function distance(x1, y1, x2, y2) {
  const a = x1 - x2;
  const b = y1 - y2;
  return Math.sqrt(a * a + b * b);
}

function App() {
  const [drawState, setDrawState] = useState(DRAW_STATE_READY);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [currentShapeIndex, setCurrentShapeIndex] = useState(-1);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [shapes, setShapes, refreshShapesState] = useHashedState("shapes", []);
  const lastOpenShapeIndex = findLastOpenShapeIndex(shapes);
  const previews = [256, 128, 64, 32];

  useEffect(() => {
    refreshShapesState();
    window.onpopstate = refreshShapesState;
    window.onhashchange = refreshShapesState;
  }, []);

  return (
    <div
      className="app-container"
      onMouseDown={handleMouseDown(
        drawState,
        setDrawState,
        setCurrentShapeIndex,
        setCurrentSegmentIndex
      )}
      onMouseMove={handleMouseMove(
        setCursorPosition,
        drawState,
        currentShapeIndex,
        currentSegmentIndex,
        shapes,
        setShapes
      )}
      onMouseUp={continueDrawing(
        cursorPosition,
        setDrawState,
        shapes,
        setShapes,
        drawState
      )}
    >
      <h1>Stateless Icon Designer</h1>
      <div className="editor">
        <h3>
          #Canvas{" "}
          <span className={"drawing-info"}>{DRAW_STATE_LABELS[drawState]}</span>
        </h3>
        <svg xmlns="http://www.w3.org/2000/svg" className="canvas" width={512} height={512}>
          {new Array(128).fill(undefined).map((_, index) => (
            <line
              key={`y-${index}`}
              x1={0}
              x2={512}
              style={{
                stroke: "silver",
              }}
              y1={index * 8}
              y2={index * 8}
            />
          ))}
          {new Array(128).fill(undefined).map((_, index) => (
            <line
              key={`x-${index}`}
              y1={0}
              y2={512}
              style={{
                stroke: "silver",
              }}
              x1={index * 8}
              x2={index * 8}
            />
          ))}
          <line
            x1={0}
            x2={512}
            style={{ stroke: "blue" }}
            y1={32 * 8}
            y2={32 * 8}
          />
          <line
            y1={0}
            y2={512}
            style={{ stroke: "blue" }}
            x1={32 * 8}
            x2={32 * 8}
          />
          {shapes.map((shape, index) => {
            const shapeWithCursor = [...shape.points, cursorPosition];
            const pointsAsSVGString = shapeWithCursor
              .map(({ x, y }) => `${x},${y}`)
              .join(" ");
            return (
              <g key={index}>
                <polygon points={pointsAsSVGString} fill={"silver"} />
                {(() => {
                  let [head, ...tail] =
                    drawState === DRAW_STATE_START &&
                    lastOpenShapeIndex === index
                      ? shapeWithCursor
                      : shape.points;
                  const onClosingPoint =
                    distance(
                      head.x,
                      head.y,
                      cursorPosition.x,
                      cursorPosition.y
                    ) > SHAPE_CLOSE_DISTANCE;
                  const lines = [
                    <circle
                      data-shape-index={index}
                      data-point-index={0}
                      className={"segment"}
                      data-is-segment={true}
                      data-is-closing-point={true}
                      key={`closing-point-${index}`}
                      cx={head.x}
                      cy={head.y}
                      fill={onClosingPoint ? "orange" : "blue"}
                      r={5}
                    />,
                  ];
                  let keyIndex = 0;
                  for (const point of tail) {
                    keyIndex++;
                    lines.push(
                      <g key={`segments-${index}-${keyIndex}`}>
                        <circle
                          data-shape-index={index}
                          data-point-index={keyIndex}
                          className={"segment"}
                          data-is-segment={true}
                          cx={point.x}
                          cy={point.y}
                          fill={"gray"}
                          r={5}
                        />
                        <line
                          stroke={"black"}
                          x1={head.x}
                          y1={head.y}
                          x2={point.x}
                          y2={point.y}
                        />
                      </g>
                    );
                    head = point;
                  }
                  return lines;
                })()}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="preview">
        {previews.map((previewSize, index) => (
          <div className={"preview-square"} key={`preview-${index}`} style={{ width: previewSize }}>
            <h3>
              {previewSize}x{previewSize}
            </h3>
            <svg xmlns="http://www.w3.org/2000/svg" className="canvas" id={`preview-${index}`} width={previewSize} height={previewSize}>
              {shapes.map((shape, index) => {
                const divider = 512 / previewSize;
                const pointsAsSVGString = shape.points
                  .map(({ x, y }) => `${x / divider},${y / divider}`)
                  .join(" ");
                return (
                  <g key={index}>
                    <polygon points={pointsAsSVGString} fill={"black"} />
                  </g>
                );
              })}
            </svg>
            <a
              href="#"
              className={'download-link'}
              onClick={(event) => {
                event.preventDefault();
                const svgImage = document.createElement("img");
                svgImage.width = previewSize;
                svgImage.height = previewSize;
                document.body.appendChild(svgImage);
                svgImage.onload = () => {
                  console.log('onload')
                  const canvas = document.createElement("canvas");
                  canvas.width = svgImage.clientWidth;
                  canvas.height = svgImage.clientHeight;
                  const canvasCtx = canvas.getContext("2d");
                  canvasCtx.drawImage(svgImage, 0, 0);
                  const imageDataURL = canvas.toDataURL("image/png");
                  svgImage.parentElement.removeChild(svgImage);
                  URL.revokeObjectURL(svgImage.src);
                  const downloadLink = document.createElement("a");
                  downloadLink.href = imageDataURL;
                  downloadLink.download = `icon-${previewSize}.png`;
                  downloadLink.click();
                };
                svgImage.src = URL.createObjectURL(
                  new Blob([document.getElementById(`preview-${index}`).outerHTML], {
                    type: "image/svg+xml",
                  })
                );
                console.log(svgImage.src)
              }}
            >
              download
            </a>
          </div>
        ))}
      </div>
      <h1>What does Stateless mean?</h1>
      <p>
        Stateless means the state of the application stored on the URL part of
        the application. It is a web application architecture defines the
        application as a framework and the access URI of the application as
        content.
      </p>
      <h1>What are the advantages of it?</h1>
      <ul>
        <li>The content is undoable and redoable by design</li>
        <li>The current state of document is bookmarkable</li>
        <li>The application state is visible for user</li>
        <li>The content can be updated in URL</li>
        <li>
          It does not need require a user authentication to share the content
        </li>
      </ul>
      <h1>Who are you?</h1>
      <p>
        I am a software engineer with 10+ years of web development and design
        experience. I am an open-source lover and I create development
        productivity tools in my spare time. I am much more focused on
        accessibility and health tech in my last years engineering experience; I
        experiment to create an accessible, crystal-clear, discoverable user
        interfaces for the end users.
      </p>
      <h1><a href="https://twitter.com/deeplyunhappie">Follow me</a> but don't get me wrong</h1>
      <p>
        When I post something on a social media, please think the post is not
        only about the content itself, but the process of posting the content
        from the very beginning (the keypress events on my keyboard) to the very
        end (the end user which is you, assigned with an IPv4 or IPv6 address;
        probably there are at least 10 dynamic routers between us). I do
        experimenting on web technologies and I need to post something and I
        usually write something super random depending on my mood; including my
        blog posts and articles.
      </p>
      <footer>Fatih Erikli — 2021 — Creative Commons</footer>
    </div>
  );
}

export default App;
