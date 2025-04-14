import { dependency, modLine} from "../../../models/AnalysisOutput";
import { lineData, generateGraphData } from "./graph";
import { updateLocationFromStackTrace } from "../dependencies";
import { getClassFromJavaFilename, isLineFromLeft } from "@extension/utils";
import { SerializedGraph } from "graphology-types";


export function updateGraph(modifiedLines: modLine[], setGraphData: React.Dispatch<React.SetStateAction<Partial<SerializedGraph> | null>>, dep: dependency, L: lineData, R: lineData, CF?: lineData, ) {
    let newGraphData;

    // get the LC and RC
    dep = updateLocationFromStackTrace(dep, { inplace: false, mode: "deep" });
  
    // get the filename and line numbers of the conflict
    let fileFrom;
    let lineFrom;
    let fileTo;
    let lineTo;
    let cfFilename = "";
    let cfLine;

    if (dep.type.startsWith("CONFLUENCE")) {
      let sourceOne = dep.body.interference.find((el) => el.type === "source1");
      let sourceTwo = dep.body.interference.find((el) => el.type === "source2");
      let confluence = dep.body.interference.find((el) => el.type === "confluence");

      if (!sourceOne || !sourceTwo || !confluence) {
        console.error("Erroe: Any interference of 'source' or 'confluence' type was founded");
        return;
      }

      fileFrom = sourceOne.location.file.replaceAll("\\", "/"); // filename source 1
      lineFrom = sourceOne; // line source 1
      fileTo = sourceTwo.location.file.replaceAll("\\", "/"); // filename source 2
      lineTo = sourceTwo; // line source 2
      cfFilename = confluence.location.file.replaceAll("\\", "/"); // filename targ
      cfLine = confluence; // line targ
    } else {
      fileFrom = dep.body.interference[0].location.file.replaceAll("\\", "/"); // first filename
      lineFrom = dep.body.interference[0]; // first line
      fileTo = dep.body.interference[dep.body.interference.length - 1].location.file.replaceAll("\\", "/"); // last filename
      lineTo = dep.body.interference[dep.body.interference.length - 1]; // last line
    }

    const LC = {
      file: fileFrom,
      line: lineFrom.location.line,
      method: lineFrom.stackTrace?.at(1)?.method ?? lineFrom.location.method
    };
    const RC = {
      file: fileTo,
      line: lineTo.location.line,
      method: lineTo.stackTrace?.at(1)?.method ?? lineTo.location.method
    };

    // If the nodes are equal, update from the stack trace
    if (getClassFromJavaFilename(L.file) === getClassFromJavaFilename(LC.file) && L.line === LC.line) {
      L.file = dep.body.interference[0].stackTrace?.at(0)?.class.replaceAll(".", "/") ?? L.file;
      L.line = dep.body.interference[0].stackTrace?.at(0)?.line ?? L.line;
    }

    if (getClassFromJavaFilename(R.file) === getClassFromJavaFilename(RC.file) && R.line === RC.line) {
      R.file =
        (dep.type.startsWith("CONFLUENCE")
          ? dep.body.interference[1].stackTrace?.at(0)?.class.replaceAll(".", "/")
          : dep.body.interference[dep.body.interference.length - 1].stackTrace?.at(0)?.class.replaceAll(".", "/")) ?? R.file;
      R.line =
        (dep.type.startsWith("CONFLUENCE")
          ? dep.body.interference[1].stackTrace?.at(0)?.line
          : dep.body.interference[dep.body.interference.length - 1].stackTrace?.at(0)?.line) ?? R.line;
    }

    //Sending the correct colors to the nodes
    let lColor = "";
    let rColor = "";

    const leftLines = [L, LC];

    if (isLineFromLeft(leftLines, modifiedLines)) {
      lColor = "#1E90FF"; //azul
      rColor = "#228B22"; //verde
    } else {
      lColor = "#228B22"; //verde
      rColor = "#1E90FF"; //azul
    }

    if (dep.type.startsWith("OA")) {
      const descriptionRegex = /<(.+:.+)> - .*<(.+:.+)>/;
      const variables = descriptionRegex.exec(dep.body.description);

      newGraphData = generateGraphData(
        "oa",
        { L, R, LC, RC },
        lColor,
        rColor,
        variables ? { variables: { left: variables[1], right: variables[2] } } : undefined
      );
    } else if (dep.type.startsWith("CONFLICT")) {
      const variables = dep.body.description.split(" - ").map((v) => /<(.+:.+)>/.exec(v)?.[1] ?? v);

      // If the conflict is DF
      newGraphData = generateGraphData("df", { L, R, LC, RC }, lColor, rColor, {
        variables: { left: variables[0], right: variables[1] }
      });
    } else if (dep.type.startsWith("CONFLUENCE")) {
      if (cfLine) {
        CF = {
          file: cfFilename,
          line: cfLine.location.line,
          method: cfLine.location.method
        };
        newGraphData = generateGraphData("cf", { L, R, LC, RC, CF }, lColor, rColor);
      }
    }

    // set the new graph data
    if (!newGraphData) setGraphData(null);
    else setGraphData(newGraphData);
  };
