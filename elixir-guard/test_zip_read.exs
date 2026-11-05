file_path = "valid_test.zip"

{:ok, _} =
  :zip.create(
    String.to_charlist(file_path),
    [
      {~c"readme.txt", "Harmless Modder Guard test"}
    ]
  )

result =
  :zip.extract(
    String.to_charlist(file_path),
    [:memory, :verbose]
  )

IO.inspect(result, label: "ZIP read result", pretty: true)

File.rm!(file_path)
