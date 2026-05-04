/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "gridstay",
      removal: input?.stage === "prod" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "eu-west-1",
        },
      },
    };
  },
  async run() {
    $transform(sst.aws.Function, (args) => {
      args.runtime = "nodejs22.x";
    });
    $transform(sst.aws.Dynamo, (args) => {
      if ($app.stage === "prod") {
        args.deletionProtection = true;
      }
    });
    await import("./infra/domain");
    await import("./infra/secrets");
    await import("./infra/database");
    await import("./infra/auth-database");
    await import("./infra/email");
    await import("./infra/available-days-cache");
    await import("./infra/circuit-distance-matrix");
    await import("./infra/hotel-summary");
    await import("./infra/site");
  },
});
