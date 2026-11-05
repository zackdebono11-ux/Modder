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
    [:memory]
  )

IO.inspect(result, label: "ZIP content verification", pretty: true)

File.rm!(file_path)
