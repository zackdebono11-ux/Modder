file_path = "valid_test.zip"

{:ok, _zip_file} =
  :zip.create(
    String.to_charlist(file_path),
    [
      {~c"readme.txt", "Harmless Modder Guard test"}
    ]
  )

IO.inspect(
  ModderGuardInspector.inspect_file(file_path),
  label: "ZIP inspection result",
  pretty: true
)

File.rm!(file_path)
