file_path = "pipeline_test.geode"

File.write!(
  file_path,
  "Harmless Modder Guard pipeline test."
)

IO.inspect(
  ModderGuardPipeline.inspect_and_scan(file_path),
  label: "Complete inspection report",
  pretty: true
)

File.rm!(file_path)
